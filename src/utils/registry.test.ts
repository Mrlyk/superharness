import { describe, expect, it } from "vitest";
import { isVersionOutdated } from "./registry.js";

describe("isVersionOutdated", () => {
	it("returns true when current is older", () => {
		expect(isVersionOutdated("0.1.0", "0.2.0")).toBe(true);
		expect(isVersionOutdated("0.2.0", "0.2.1")).toBe(true);
		expect(isVersionOutdated("0.2.0", "1.0.0")).toBe(true);
	});

	it("returns false when current equals or newer", () => {
		expect(isVersionOutdated("0.2.0", "0.2.0")).toBe(false);
		expect(isVersionOutdated("0.3.0", "0.2.9")).toBe(false);
		expect(isVersionOutdated("1.0.0", "0.99.99")).toBe(false);
	});

	it("tolerates leading v prefix", () => {
		expect(isVersionOutdated("v0.1.0", "v0.2.0")).toBe(true);
	});

	it("compares prerelease segments numerically as fallback", () => {
		expect(isVersionOutdated("0.2.0-1", "0.2.0-2")).toBe(true);
	});
});
