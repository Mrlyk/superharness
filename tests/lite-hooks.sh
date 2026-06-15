#!/usr/bin/env bash
# Behaviour tests for the lite hooks (hooks/lite/*.cjs) — runs the real scripts
# against fixture repos. Asserts trigger/silence behaviour, not message wording.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$REPO/hooks/lite"
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
nlines() { python3 -c "import sys;print(chr(10).join('x'+str(i)+'=1' for i in range(int(sys.argv[1]))))" "$1"; }
verify() { printf '{"session_id":"%s","cwd":"%s","stop_hook_active":%s}' "$1" "$2" "${3:-false}" | node "$HOOKS/stop-verify.cjs"; }

mkdir -p "$TMP/nogit"

echo "== stop-verify.cjs =="
R="$TMP/r"; mkrepo "$R"
nlines 8 > "$R/sol.py"
assert_contains "new code file gates regardless of size" "$(verify s1 "$R")" '"decision":"block"'
assert_empty "same state stays silent (churn cursor)" "$(verify s1 "$R")"

git -C "$R" add -A; git -C "$R" commit -qm base >/dev/null 2>&1
# a NEW file already `git add`ed must still gate (not only untracked ones)
nlines 6 > "$R/staged.py"; git -C "$R" add staged.py
assert_contains "staged new code file gates regardless of size" "$(verify sg "$R")" '"decision":"block"'
git -C "$R" rm -q --cached staged.py >/dev/null 2>&1; rm -f "$R/staged.py"
printf 'a=1\nb=2\n' >> "$R/sol.py"
assert_empty "small edit to a tracked file stays silent" "$(verify s2 "$R")"

printf 'hello\n' > "$R/notes.md"
assert_empty "new doc file stays silent (not code)" "$(verify s3 "$R")"

mkdir -p "$R/.claude/hooks"; printf 'const x = 1;\n' > "$R/.claude/hooks/foo.cjs"
assert_empty "tool dirs (.claude) are ignored" "$(verify s4 "$R")"

assert_empty "stop_hook_active suppresses the gate" "$(verify s5 "$R" true)"
assert_empty "non-git cwd stays silent" "$(printf '{"session_id":"s6","cwd":"%s"}' "$TMP/nogit" | node "$HOOKS/stop-verify.cjs")"

nlines 30 >> "$R/sol.py"
assert_contains "large edit to a tracked file gates" "$(verify s7 "$R")" '"decision":"block"'

echo "== session-start.cjs =="
S="$TMP/s"; mkrepo "$S"; printf '{}' > "$S/package.json"
ss() { printf '{"cwd":"%s","source":"startup"}' "$1" | node "$HOOKS/session-start.cjs"; }
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
assert_empty "non-git cwd stays silent" "$(printf '{"cwd":"%s","source":"startup"}' "$TMP/nogit" | node "$HOOKS/session-start.cjs")"

echo
echo "lite-hooks: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
