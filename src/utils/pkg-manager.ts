import { execSync } from "node:child_process";
import { resolve } from "node:path";

export type PkgManager = "npm" | "pnpm" | "yarn" | "bun" | "tnpm";

interface ManagerProbe {
	name: PkgManager;
	rootCmd: string;
	installCmd: (pkg: string) => string;
}

const PROBES: ManagerProbe[] = [
	{
		name: "pnpm",
		rootCmd: "pnpm root -g",
		installCmd: (pkg) => `pnpm add -g ${pkg}@latest`,
	},
	{
		name: "yarn",
		rootCmd: "yarn global dir",
		installCmd: (pkg) => `yarn global add ${pkg}@latest`,
	},
	{
		name: "bun",
		rootCmd: "bun pm bin -g",
		installCmd: (pkg) => `bun add -g ${pkg}@latest`,
	},
	{
		name: "tnpm",
		rootCmd: "tnpm root -g",
		installCmd: (pkg) => `tnpm i -g ${pkg}@latest`,
	},
	{
		name: "npm",
		rootCmd: "npm root -g",
		installCmd: (pkg) => `npm i -g ${pkg}@latest`,
	},
];

function probeRoot(cmd: string, timeoutMs = 3000): string | null {
	try {
		const out = execSync(cmd, {
			stdio: ["ignore", "pipe", "ignore"],
			timeout: timeoutMs,
			encoding: "utf-8",
		}).trim();
		return out || null;
	} catch {
		return null;
	}
}

function isAncestor(parent: string, child: string): boolean {
	const p = resolve(parent);
	const c = resolve(child);
	if (p === c) return true;
	const sep = p.endsWith("/") ? p : `${p}/`;
	return c.startsWith(sep);
}

export function detectPkgManager(packageRoot: string): PkgManager {
	for (const probe of PROBES) {
		const root = probeRoot(probe.rootCmd);
		if (root && isAncestor(root, packageRoot)) {
			return probe.name;
		}
	}
	return "npm";
}

export function buildInstallCommand(manager: PkgManager, pkg: string): string {
	const probe = PROBES.find((p) => p.name === manager);
	if (!probe) return `npm i -g ${pkg}@latest`;
	return probe.installCmd(pkg);
}
