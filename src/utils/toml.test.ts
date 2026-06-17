import { describe, expect, it } from "vitest";
import { tomlBasicString, tomlMultilineLiteral } from "./toml.js";

describe("tomlBasicString", () => {
	it("double-quotes a plain string", () => {
		expect(tomlBasicString("hello")).toBe('"hello"');
	});

	it("escapes embedded double quotes and backslashes", () => {
		expect(tomlBasicString('a "b" c')).toBe('"a \\"b\\" c"');
		expect(tomlBasicString("a\\b")).toBe('"a\\\\b"');
	});

	it("escapes control whitespace", () => {
		expect(tomlBasicString("line1\nline2")).toBe('"line1\\nline2"');
		expect(tomlBasicString("a\tb")).toBe('"a\\tb"');
	});
});

describe("tomlMultilineLiteral", () => {
	it("wraps the value verbatim in triple single quotes on its own lines", () => {
		expect(tomlMultilineLiteral("# Title\nbody")).toBe(
			"'''\n# Title\nbody\n'''",
		);
	});

	it("does not escape backslashes or quotes inside the body", () => {
		expect(tomlMultilineLiteral('a\\b "c"')).toBe("'''\na\\b \"c\"\n'''");
	});
});
