import { join } from "node:path";
import { removeSuperharnessHooks } from "../utils/hooks.js";
import { logSuccess, logWarn } from "../utils/log.js";
import { ADAPTERS } from "./adapter.js";
import { FULL_JS_HOOKS, removeFullOnlySkills, rmIfExists } from "./shared.js";

function uninstallFullAoneCopilot(
	projectDir: string,
	packageRoot: string,
): void {
	const aoneDir = join(projectDir, ".aone_copilot");
	removeFullOnlySkills(packageRoot, join(aoneDir, "skills"));
	for (const h of FULL_JS_HOOKS) rmIfExists(join(aoneDir, "hooks", h));
	removeSuperharnessHooks(join(aoneDir, "hooks.json"));
	logSuccess("Aone Copilot: 已移除 full 产物 (skill/hooks/hooks.json)");
}

// Strip full-mode artifacts for one platform before lite reinstalls. Only the
// lite-supported platforms get cleaned + reinstalled; full-only platforms
// (cursor) are reported separately and left untouched.
export function uninstallFullPlatform(
	platform: string,
	projectDir: string,
	packageRoot: string,
): void {
	const adapter = ADAPTERS[platform];
	if (adapter) {
		adapter.uninstallFull(projectDir, packageRoot);
		return;
	}
	if (platform === "aone-copilot") {
		uninstallFullAoneCopilot(projectDir, packageRoot);
		return;
	}
	logWarn(`无 full 卸载逻辑，跳过 "${platform}"`);
}
