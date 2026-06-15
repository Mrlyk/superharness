#!/usr/bin/env node
'use strict';
// Grade auto-learning generation. Inspects the .superharness/learnings/ the
// model wrote. standard mode = recall (both corrections captured); hard mode
// = precision (capture the team convention, reject the throwaway one-offs).
// Usage: learn-auto.js <fixtureDir> <arm> <trial> [standard|hard]
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const arm = process.argv[3];
const trial = Number(process.argv[4]);
const mode = process.argv[5] || 'standard';

const learnDir = path.join(dir, '.superharness', 'learnings');
const indexFile = path.join(learnDir, 'INDEX.md');

function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } }

let entries = [];
try {
  entries = fs.readdirSync(learnDir)
    .filter((f) => f.endsWith('.md') && f !== 'INDEX.md')
    .map((f) => path.join(learnDir, f));
} catch { /* none */ }

const corpus = entries.map(read).join('\n');
const indexText = read(indexFile);

let checks;
if (mode === 'hard') {
  // The durable rule: API error codes use the E_ prefix.
  const capturesPrefix = /E_[A-Z]/.test(corpus)
    && /(prefix|error code|convention)/i.test(corpus);
  // The two throwaways that must NOT be persisted.
  const leakedValidation = /(skip|no|without).{0,20}validation|validation.{0,20}later/i.test(corpus);
  const leakedConsoleLog = /console\.log|temporary log|log.{0,20}(today|watch)/i.test(corpus);
  // reject* is only meaningful once something was generated — an empty arm A
  // is not "precise", it simply did nothing. Gate the credit on generated.
  const gen = entries.length >= 1;
  checks = {
    generated: gen,
    capturesErrorPrefix: capturesPrefix,
    rejectsTransientValidation: gen && !leakedValidation,
    rejectsTransientLogging: gen && !leakedConsoleLog,
    indexUpdated: /\]\([^)]*\.md\)/.test(indexText),
    formatOk: /(title|topic):/i.test(corpus),
    concise: gen && entries.length <= 2,
  };
} else {
  checks = {
    generated: entries.length >= 1,
    capturesIsoRule: /iso[\s-]?8601|toISOString|\butc\b/i.test(corpus),
    capturesCentsRule: /\bcents\b|integer cents|never float/i.test(corpus),
    indexUpdated: /\]\([^)]*\.md\)/.test(indexText),
    formatOk: /(title|topic):/i.test(corpus),
    concise: entries.length >= 1 && entries.length <= 3,
  };
}

const values = Object.values(checks);
const score = values.filter(Boolean).length / values.length;
process.stdout.write(JSON.stringify({
  scenario: 'learn_auto', mode, arm, trial, checks, score, entries: entries.length,
}) + '\n');
