#!/usr/bin/env node
"use strict";
// Aggregate every lite benchmark result file into one report whose headline is
// the three-column A/B table (Baseline | + superharness lite | Δ) the README
// embeds, plus per-scenario check breakdowns.
//
//   node report-lite.js <resultsDir>
//
// Reads, when present:
//   lite-suite-results.jsonl        s1..s4 + control
//   lite-learn-standard-results.jsonl / lite-learn-hard-results.jsonl
//   lite-clarify-results.jsonl
//   heval-plus-lite-results.jsonl   (from heval-lite.sh --plus)
const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const read = (f) => {
	try {
		return fs.readFileSync(f, "utf8");
	} catch {
		return "";
	}
};
const rows = (f) =>
	read(path.join(dir, f))
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((l) => {
			try {
				return JSON.parse(l);
			} catch {
				return null;
			}
		})
		.filter(Boolean);
const pct = (x) => `${Math.round(x * 100)}%`;
const mean = (a) =>
	a.length ? a.reduce((s, r) => s + r.score, 0) / a.length : null;

// Each table line: { label, measure, a, b, n }. a/b in [0,1]; null = not run.
const lines = [];
function checkTable(rs, armOf) {
	const rates = {};
	for (const r of rs)
		for (const [k, v] of Object.entries(r.checks || {})) {
			const a = armOf(r);
			if (!a) continue;
			rates[k] = rates[k] || { A: { p: 0, n: 0 }, B: { p: 0, n: 0 } };
			rates[k][a].n += 1;
			if (v) rates[k][a].p += 1;
		}
	return rates;
}

// ---- lite-suite (s1..s4 + control) ----
const suite = rows("lite-suite-results.jsonl");
const SUITE_META = {
	s1: ["Convention adherence", "discover spec", "mean check score"],
	s2: ["Cross-session memory", "learn + SessionStart hook", "mean check score"],
	s3: ["Requirement clarification", "clarify", "asked-before-guessing rate"],
	s4: ["Final test pass", "test gate", "mean check score"],
	control: ["Control · HumanEval/0–9", "regression check", "pass@1"],
};
for (const [s, [label, , measure]] of Object.entries(SUITE_META)) {
	const A = suite.filter((r) => r.scenario === s && r.arm === "A");
	const B = suite.filter((r) => r.scenario === s && r.arm === "B");
	if (!A.length && !B.length) continue;
	const score = (rs) =>
		s === "s3"
			? rs.length
				? rs.filter((r) => r.score === 1).length / rs.length
				: null
			: mean(rs);
	lines.push({
		label,
		measure,
		a: score(A),
		b: score(B),
		nA: A.length,
		nB: B.length,
		s,
		kind: "suite",
	});
}

// ---- auto-learning (standard recall, hard precision/wiki) ----
for (const [mode, label] of [
	["standard", "Auto-learning · recall"],
	["hard", "Auto-learning · precision (wiki)"],
]) {
	const rs = rows(`lite-learn-${mode}-results.jsonl`);
	if (!rs.length) continue;
	const A = rs.filter((r) => r.arm === "A");
	const B = rs.filter((r) => r.arm === "B");
	lines.push({
		label,
		measure: "mean check score",
		a: mean(A),
		b: mean(B),
		nA: A.length,
		nB: B.length,
		key: `learn-${mode}`,
		kind: "learn",
	});
}

// ---- clarify auto-trigger (lift on ambiguous; guard on clear) ----
const clar = rows("lite-clarify-results.jsonl");
if (clar.length) {
	const rate = (arm, type) => {
		const g = clar.filter((r) => r.arm === arm && r.taskType === type);
		return g.length ? g.filter((r) => r.score === 1).length / g.length : null;
	};
	const baseA = rate("base-ambiguous", "ambiguous");
	const liteA = rate("lite-ambiguous", "ambiguous");
	if (baseA !== null || liteA !== null) {
		const nA = clar.filter((r) => r.arm === "base-ambiguous").length;
		const nB = clar.filter((r) => r.arm === "lite-ambiguous").length;
		lines.push({
			label: "Clarify · self-triggered",
			measure: "auto-asked-then-no-guess rate",
			a: baseA,
			b: liteA,
			nA,
			nB,
			kind: "clarify-lift",
		});
	}
	const guard = rate("lite-clear", "clear");
	if (guard !== null) {
		const n = clar.filter((r) => r.arm === "lite-clear").length;
		lines.push({
			label: "Clarify · over-ask guard (clear task)",
			measure: "proceeded-without-over-asking rate",
			a: null,
			b: guard,
			nA: 0,
			nB: n,
			kind: "clarify-guard",
		});
	}
}

// ---- HumanEval+ hard subset (north-star, from heval-lite.sh --plus) ----
const heval = rows("heval-plus-lite-results.jsonl");
if (heval.length) {
	const A = heval.filter((r) => r.arm === "A");
	const B = heval.filter((r) => r.arm === "B");
	lines.push({
		label: "HumanEval+ hard subset",
		measure: "pass@1",
		a: mean(A),
		b: mean(B),
		nA: A.length,
		nB: B.length,
		kind: "heval",
	});
}

// ---- render ----
const out = [];
out.push("## Results summary");
out.push("");
out.push(
	"| Scenario | Measures | Baseline (bare model) | + superharness lite | Δ |",
);
out.push(
	"|----------|----------|-----------------------|---------------------|---|",
);
for (const r of lines) {
	const a = r.a === null ? "—" : pct(r.a);
	const b = r.b === null ? "—" : pct(r.b);
	let d = "—";
	if (r.a !== null && r.b !== null) {
		const dp = Math.round((r.b - r.a) * 100);
		d = `**${dp >= 0 ? "+" : ""}${dp}pp**`;
		if (dp === 0) d = "even";
	} else if (r.b !== null) d = `(${b})`;
	out.push(`| ${r.label} | ${r.measure} | ${a} | ${b} | ${d} |`);
}
out.push("");

// per-scenario check detail
function detail(title, rs, armOf, note) {
	if (!rs.length) return;
	out.push(`### ${title}`);
	out.push("");
	if (note) {
		out.push(note);
		out.push("");
	}
	const rates = checkTable(rs, armOf);
	out.push("| Check | Baseline | + lite |");
	out.push("|-------|----------|--------|");
	for (const [k, v] of Object.entries(rates)) {
		out.push(
			`| ${k} | ${v.A.n ? `${v.A.p}/${v.A.n}` : "—"} | ${v.B.n ? `${v.B.p}/${v.B.n}` : "—"} |`,
		);
	}
	out.push("");
}
for (const [s, [label]] of Object.entries(SUITE_META)) {
	if (s === "control") continue;
	detail(
		label,
		suite.filter((r) => r.scenario === s),
		(r) => r.arm,
	);
}
for (const mode of ["standard", "hard"]) {
	const rs = rows(`lite-learn-${mode}-results.jsonl`);
	detail(`Auto-learning · ${mode}`, rs, (r) => r.arm);
}
detail(
	"Clarify auto-trigger",
	clar.map((r) => ({ ...r, arm: r.arm === "base-ambiguous" ? "A" : "B" })),
	(r) => r.arm,
	"A = bare model (baseline); B = superharness lite installed (clarify skill + SessionStart-injected operating manual). Ambiguous + clear tasks combined.",
);

const totDur = [
	...suite,
	...rows("lite-learn-standard-results.jsonl"),
	...rows("lite-learn-hard-results.jsonl"),
	...clar,
	...heval,
].reduce((s, r) => s + (r.durationSec || 0), 0);
if (totDur)
	out.push(
		`Total model runtime across these results: ${Math.round(totDur / 60)} min.`,
	);
process.stdout.write(out.join("\n") + "\n");
