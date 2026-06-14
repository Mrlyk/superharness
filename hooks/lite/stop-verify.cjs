#!/usr/bin/env node
'use strict';
// superharness lite Stop hook: verify-before-done gate.
// When code changed this session and has not been run, block the stop once and
// tell the model to execute the changed behavior (documented examples + boundary
// cases) before finishing — fixing real failures but not refactoring code that
// already passes. The heavier spec + code review is the explicit test skill.
//
// Re-arms per coding round via a churn cursor: it fires again once enough NEW
// code accumulates beyond the round it last gated — a multi-task session is
// reviewed each round, not once total. Trivial changes (a few lines) never fire.
// Silent on everything else.
//
// Env:
//   SUPERHARNESS_VERIFY_MIN_LINES=N  churn threshold in changed code lines (default 20)
//   SUPERHARNESS_NO_VERIFY=1         disable the gate entirely

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CODE_EXT = /\.(py|js|jsx|ts|tsx|mjs|cjs|go|rs|java|rb|php|c|cc|cpp|h|hpp|cs|swift|kt|scala|m|mm|vue|svelte)$/i;
// Tool/scaffolding dirs are not user code — don't count harness install output,
// dependencies, or build artifacts toward the review threshold.
const IGNORE_DIR = /(^|\/)(\.git|\.claude|\.superharness|\.aone_copilot|\.codex|node_modules|dist|build|out|coverage|\.next|\.nuxt|vendor|target|\.venv|venv|__pycache__)\//;

function minLines() {
  const n = parseInt(process.env.SUPERHARNESS_VERIFY_MIN_LINES, 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

function stateDir() {
  return process.env.SUPERHARNESS_STATE_DIR
    || path.join(os.homedir(), '.superharness', 'state');
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function findGitRoot(dir) {
  let cur = dir;
  while (cur && cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, '.git'))) return cur;
    cur = path.dirname(cur);
  }
  return null;
}

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000,
    });
  } catch { return null; }
}

// Total changed lines (added + deleted) in code files vs HEAD, plus the line
// count of untracked code files — a heuristic for how much unreviewed code there
// is right now. Doc-only churn does not count.
function codeChurn(root) {
  let churn = 0;
  let newFiles = 0;
  const numstat = git(root, ['diff', '--numstat', 'HEAD', '--']);
  if (numstat) {
    for (const line of numstat.split('\n')) {
      if (!line.trim()) continue;
      const cols = line.split('\t');
      if (cols.length < 3) continue;
      const [add, del, file] = cols;
      if (add === '-' || !CODE_EXT.test(file) || IGNORE_DIR.test(file)) continue;
      churn += (parseInt(add, 10) || 0) + (parseInt(del, 10) || 0);
    }
  }
  const others = git(root, ['ls-files', '--others', '--exclude-standard']);
  if (others) {
    for (const file of others.split('\n')) {
      if (!file.trim() || !CODE_EXT.test(file) || IGNORE_DIR.test(file)) continue;
      newFiles++;
      try {
        churn += fs.readFileSync(path.join(root, file), 'utf8').split('\n').length;
      } catch { /* unreadable, skip */ }
    }
  }
  return { churn, newFiles };
}

function readState(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function main() {
  if (process.env.SUPERHARNESS_NO_VERIFY === '1') return;
  let input = {};
  try { input = JSON.parse(readStdin()); } catch { return; }
  if (input.stop_hook_active) return; // never loop

  const cwd = input.cwd || process.cwd();
  const root = findGitRoot(cwd);
  if (!root) return;

  const sessionId = String(input.session_id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sessionId) return;

  const { churn, newFiles } = codeChurn(root);
  const threshold = minLines();

  const dir = stateDir();
  fs.mkdirSync(dir, { recursive: true });
  const stateFile = path.join(dir, `${sessionId}.verify.json`);
  const st = readState(stateFile) || { verifiedChurn: 0 };

  // A commit (or revert) dropped the pending churn — rebaseline so the next
  // round re-arms from here, and stay silent.
  if (churn < st.verifiedChurn) {
    fs.writeFileSync(stateFile, JSON.stringify({ verifiedChurn: churn }));
    return;
  }
  // Nothing new since the last review.
  if (churn === st.verifiedChurn) return;
  // New code since the last review. A brand-new code file is wholly unreviewed,
  // so it always gates; edits to existing files gate only past the line
  // threshold (a few-line tweak is not worth a full review).
  if (newFiles === 0 && churn - st.verifiedChurn < threshold) return;

  fs.writeFileSync(stateFile, JSON.stringify({ verifiedChurn: churn }));
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      'You changed code this session but have not run it. Before finishing, write a short '
      + 'throwaway test script that asserts BOTH the documented examples AND adversarial edge '
      + 'cases that could break your implementation — empty / single-element / duplicate / '
      + 'large inputs, zero and negative values, off-by-one boundaries, and any case your '
      + 'algorithm handles only implicitly. Run it. If an assertion fails, fix the root cause '
      + 'in the code, not the test; if everything passes, do NOT refactor working code. Delete '
      + 'the script and include the run output. For a larger change, run the superharness test skill.',
  }));
}

try { main(); } catch { /* never block the stop on our own errors */ }
process.exit(0);
