import { existsSync, mkdirSync, cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logSuccess, logWarn } from "../utils/log.js";
import type { Platform } from "../platforms/index.js";
import { setupLitePlatform, LITE_PLATFORMS } from "../platforms/lite.js";

const SUPERHARNESS_DIR = ".superharness";

// Lite scaffolding: just the two knowledge stores (spec + learnings) and a
// minimal config. No spec templates, tasks/, workspace/, workflow.md — those
// are the heavy greenfield workflow that lite drops.
export function setupLite(
	projectDir: string,
	packageRoot: string,
	platforms: Platform[],
): void {
	// Lite supports only a subset of platforms; drop the rest so config.yaml
	// never claims an adapter that was never installed.
	for (const p of platforms) {
		if (!(LITE_PLATFORMS as readonly string[]).includes(p))
			logWarn(`lite 不支持平台 "${p}"，已从安装与配置中剔除`);
	}
	// Only fall back to nothing — never silently install an adapter the user did
	// not ask for. (`init` with no --platforms still defaults to claude-code via
	// commander, so the empty case here means the user explicitly chose only
	// unsupported platforms.)
	const effective: Platform[] = platforms.filter((p) =>
		(LITE_PLATFORMS as readonly string[]).includes(p),
	);
	if (effective.length === 0)
		logWarn(
			"lite 仅支持 claude-code / codex / aone-copilot；本次没有可安装的平台适配",
		);

	const shDir = join(projectDir, SUPERHARNESS_DIR);
	mkdirSync(join(shDir, "learnings"), { recursive: true });
	mkdirSync(join(shDir, "spec", "guides"), { recursive: true });

	const indexPath = join(shDir, "learnings", "INDEX.md");
	if (!existsSync(indexPath)) writeFileSync(indexPath, "# Learnings\n");

	// Blank spec entry; discover fills the tree from real code evidence.
	const skeletonSrc = join(
		packageRoot,
		"spec-templates",
		"blank",
		"guides",
		"index.md",
	);
	const specEntry = join(shDir, "spec", "guides", "index.md");
	if (existsSync(skeletonSrc) && !existsSync(specEntry))
		cpSync(skeletonSrc, specEntry);

	const name = projectDir.split("/").pop() || "my-project";
	const platformsBlock = effective.map((p) => `  - ${p}`).join("\n");
	writeFileSync(
		join(shDir, "config.yaml"),
		`# superharness lite\nproject:\n  name: ${name}\nplatforms:\n${platformsBlock}\n`,
	);

	logSuccess("已创建 .superharness/ (lite: learnings + spec 骨架)");

	for (const platform of effective) {
		setupLitePlatform(platform, projectDir, packageRoot);
	}
}
