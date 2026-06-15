#!/usr/bin/env node
'use strict';
// Grade the clarify-nudge micro-benchmark. Measures whether an AGENTS.md that
// carries the discover clarify pointer makes the model AUTO-trigger clarify on
// an ambiguous request (the lift) without over-asking on a clear one (the guard).
// Usage: clarify-nudge.js <fixtureDir> <responseFile> <arm> <taskType>
const { execFileSync } = require('child_process');
const fs = require('fs');

const dir = process.argv[2];
const response = (() => { try { return fs.readFileSync(process.argv[3], 'utf8'); } catch { return ''; } })();
const arm = process.argv[4];
const taskType = process.argv[5]; // ambiguous | clear

// A clarifying question = a line that both asks and names the open decision.
// Per-line matching avoids crediting code-block ternaries that share the text.
const asked = response.split('\n').some((line) =>
  /[?？]/.test(line)
  && /(csv|json|format|column|field|spreadsheet|schema|which|scope|include|filter|sort|date range|格式|字段|列|范围|哪些)/i.test(line));

function git(args) {
  try { return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', timeout: 5000 }); }
  catch { return '?? unknown.js'; } // treat failures as "dirty" so we never falsely credit "no code"
}
const wroteCode = git(['status', '--porcelain'])
  .split('\n').some((l) => /\.(js|mjs|ts)$/.test(l.trim()));

let checks;
if (taskType === 'clear') {
  // Guard: a clear, fully specified task should be implemented, not interrogated.
  checks = { proceeded: wroteCode, didNotOverAsk: !asked };
} else {
  // Lift: an ambiguous request should surface the load-bearing question first.
  checks = { askedKeyQuestion: asked, noPrematureCode: !wroteCode };
}
const values = Object.values(checks);
const score = values.filter(Boolean).length / values.length;
process.stdout.write(JSON.stringify({
  scenario: 'clarify_nudge', arm, taskType, checks, score, asked, wroteCode,
}) + '\n');
