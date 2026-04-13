import { describe, expect, it } from "vitest";
import { buildInstallCommand } from "./pkg-manager.js";

describe("buildInstallCommand", () => {
	it("renders correct install command per manager", () => {
		expect(buildInstallCommand("npm", "@ali/superharness")).toBe(
			"npm i -g @ali/superharness@latest",
		);
		expect(buildInstallCommand("pnpm", "superharness")).toBe(
			"pnpm add -g superharness@latest",
		);
		expect(buildInstallCommand("yarn", "superharness")).toBe(
			"yarn global add superharness@latest",
		);
		expect(buildInstallCommand("bun", "superharness")).toBe(
			"bun add -g superharness@latest",
		);
		expect(buildInstallCommand("tnpm", "@ali/superharness")).toBe(
			"tnpm i -g @ali/superharness@latest",
		);
	});
});
