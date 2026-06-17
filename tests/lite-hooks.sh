#!/usr/bin/env bash
# Behaviour tests for the lite hooks (dist/hooks/*-lite.js, built by tsup) — runs
# the real scripts against fixture repos. Asserts trigger/silence behaviour, not
# message wording. Requires a prior `npm run build` (test:hooks chains it).
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$REPO/dist/hooks"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export SUPERHARNESS_STATE_DIR="$TMP/state"

PASS=0
FAIL=0
ok() { PASS=$((PASS + 1)); echo "  ok: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "FAIL: $1" >&2; }
assert_contains() { [[ "$2" == *"$3"* ]] && ok "$1" || fail "$1 (missing '$3'; got: ${2:0:120})"; }
assert_empty() { [[ -z "$2" ]] && ok "$1" || fail "$1 (expected empty; got: ${2:0:120})"; }

mkrepo() {
  mkdir -p "$1"
  git -C "$1" init -q
  git -C "$1" config user.email t@t.local
  git -C "$1" config user.name t
}
mkdir -p "$TMP/nogit"

echo "== session-start-lite.js =="
S="$TMP/s"; mkrepo "$S"; printf '{}' > "$S/package.json"
ss() { printf '{"cwd":"%s","source":"startup"}' "$1" | node "$HOOKS/session-start-lite.js"; }
assert_contains "bare project suggests discover" "$(ss "$S")" 'discover'
mkdir -p "$S/.superharness/learnings"; printf '# Learnings\n- [T](t.md) — x\n' > "$S/.superharness/learnings/INDEX.md"
assert_contains "injects the learnings index" "$(ss "$S")" 'Past learnings'
# fresh lite init writes a blank spec skeleton but no spec pointer — must still suggest discover
mkdir -p "$S/.superharness/spec/guides"; printf '# Project Guides\n' > "$S/.superharness/spec/guides/index.md"
assert_contains "skeleton spec without spec pointer still suggests discover" "$(ss "$S")" 'discover'
# a pre-existing AGENTS.md from another tool must NOT count as discover-done
printf '# proj\n' > "$S/AGENTS.md"
assert_contains "bare AGENTS.md still suggests discover" "$(ss "$S")" 'scan the codebase and generate'
# AGENTS.md wired with the superharness spec pointer DOES count — nudge stops
printf 'Read .superharness/spec/guides/index.md before writing code.\n' >> "$S/AGENTS.md"
assert_empty "wired AGENTS.md stops the discover nudge" "$(ss "$S" | grep -o 'scan the codebase and generate' || true)"
assert_empty "non-git cwd stays silent" "$(printf '{"cwd":"%s","source":"startup"}' "$TMP/nogit" | node "$HOOKS/session-start-lite.js")"

echo "== session-start-lite.js (UserPromptSubmit / Qoder) =="
# Qoder has no SessionStart, so the hook runs on UserPromptSubmit and must inject
# only on the first prompt of a session (keyed by session_id). S still has the
# learnings index created above, so there is something to inject.
ups() { printf '{"cwd":"%s","hook_event_name":"UserPromptSubmit","session_id":"%s"}' "$1" "$2" | node "$HOOKS/session-start-lite.js"; }
out1="$(ups "$S" qsess1)"
assert_contains "UserPromptSubmit injects on the first prompt" "$out1" 'Past learnings'
assert_contains "UserPromptSubmit tags the output with its own event name" "$out1" 'UserPromptSubmit'
assert_empty "same session stays silent on later prompts" "$(ups "$S" qsess1)"
assert_contains "a new session_id injects again" "$(ups "$S" qsess2)" 'Past learnings'

echo
echo "lite-hooks: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
