// Minimal TOML value serializers — no third-party dependency. Just enough to emit
// the agent files Codex consumes: single-line strings for name/description, and
// the agent body as a multiline block. This is NOT a general-purpose TOML writer.

// A single-line TOML basic string: double-quoted, with backslash / quote / control
// characters escaped so the value round-trips.
export function tomlBasicString(value: string): string {
	const escaped = value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\t/g, "\\t")
		.replace(/\r/g, "\\r")
		.replace(/\n/g, "\\n");
	return `"${escaped}"`;
}

// A multiline TOML literal string ('''…'''): content is taken verbatim, with no
// escape processing — ideal for Markdown bodies with backslashes and code fences.
// The caller MUST guarantee the value contains no ''' delimiter (a unit test
// guards the shipped agent bodies). TOML trims the newline immediately after the
// opening delimiter, so the value round-trips as `${value}\n`.
export function tomlMultilineLiteral(value: string): string {
	return `'''\n${value}\n'''`;
}
